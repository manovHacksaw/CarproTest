// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CarRental {

    address public owner;
    address public authorizedBackend;
    uint256 public rentalFee;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyBackend() {
        require(msg.sender == authorizedBackend, "Not authorized: backend only");
        _;
    }

    struct Reservation {
        address renter;
        string carType;
        uint256 pickUpDate;
        uint256 dropOffDate;
        bool confirmed;
    }

    Reservation[] public reservations;
    uint256 public reservationCount;

    mapping(uint256 => uint256) public reservationPayments;

    enum DisputeOutcome { None, Refunded, Rejected }

    struct Dispute {
        address renter;
        string reason;
        bool raised;
        DisputeOutcome outcome;
    }

    mapping(uint256 => Dispute) public disputes;

    event CarBooked(uint256 indexed reservationId, address indexed renter, string carType, uint256 pickUpDate, uint256 dropOffDate);
    event ReservationConfirmed(uint256 indexed reservationId);
    event ReservationCanceled(uint256 indexed reservationId);
    event BackendAuthorized(address indexed backend);
    event PaymentReceived(uint256 indexed reservationId, address indexed renter, uint256 amount);
    event FundsWithdrawn(address indexed owner, uint256 amount);
    event RentalFeeUpdated(uint256 newFee);
    event DisputeRaised(uint256 indexed reservationId, address indexed renter, string reason);
    event DisputeResolved(uint256 indexed reservationId, address indexed resolver, bool refunded);
    event RefundIssued(uint256 indexed reservationId, address indexed renter, uint256 amount, string reason);

    constructor(address _authorizedBackend) {
        owner = msg.sender;
        authorizedBackend = _authorizedBackend;
        reservationCount = 0;
        emit BackendAuthorized(_authorizedBackend);
    }

    function setAuthorizedBackend(address _backend) external onlyOwner {
        authorizedBackend = _backend;
        emit BackendAuthorized(_backend);
    }

    function setRentalFee(uint256 _fee) external onlyOwner {
        rentalFee = _fee;
        emit RentalFeeUpdated(_fee);
    }

    function bookCar(
        address _renter,
        string memory _carType,
        uint256 _pickUpDate,
        uint256 _dropOffDate
    ) external payable onlyBackend {
        require(msg.value >= rentalFee, "Insufficient payment");
        uint256 reservationId = reservationCount;
        reservations.push(Reservation(_renter, _carType, _pickUpDate, _dropOffDate, false));
        reservationCount++;
        reservationPayments[reservationId] = msg.value;
        emit CarBooked(reservationId, _renter, _carType, _pickUpDate, _dropOffDate);
        emit PaymentReceived(reservationId, _renter, msg.value);
    }

    function confirmReservation(uint256 _reservationId) external onlyBackend {
        require(_reservationId < reservationCount, "Invalid reservation ID");
        reservations[_reservationId].confirmed = true;
        emit ReservationConfirmed(_reservationId);
    }

    function cancelReservation(uint256 _reservationId) external onlyBackend {
        require(_reservationId < reservationCount, "Invalid reservation ID");

        // Capture before delete zeroes the struct
        address renter = reservations[_reservationId].renter;
        uint256 pickUpDate = reservations[_reservationId].pickUpDate;
        uint256 payment = reservationPayments[_reservationId];

        // Effects: zero out state before any transfer
        delete reservations[_reservationId];
        reservationPayments[_reservationId] = 0;
        emit ReservationCanceled(_reservationId);

        // Interactions: transfer refund based on cancellation timing
        if (payment > 0 && renter != address(0)) {
            uint256 refundAmount = 0;
            string memory reason;

            if (block.timestamp < pickUpDate) {
                if (pickUpDate - block.timestamp > 48 hours) {
                    refundAmount = payment;
                    reason = "Full refund: cancelled >48h before pickup";
                } else {
                    refundAmount = payment / 2;
                    reason = "Partial refund: cancelled within 48h of pickup";
                }
            }
            // Past pickup date: no refund, ETH stays in contract

            if (refundAmount > 0) {
                (bool ok, ) = payable(renter).call{value: refundAmount}("");
                require(ok, "Refund transfer failed");
                emit RefundIssued(_reservationId, renter, refundAmount, reason);
            }
        }
    }

    function withdraw() external onlyOwner {
        uint256 amount = address(this).balance;
        require(amount > 0, "Nothing to withdraw");
        (bool ok, ) = payable(owner).call{value: amount}("");
        require(ok, "Withdraw failed");
        emit FundsWithdrawn(owner, amount);
    }

    function raiseDispute(uint256 _reservationId, string memory _reason) external onlyBackend {
        require(_reservationId < reservationCount, "Invalid reservation ID");
        require(reservations[_reservationId].confirmed, "Reservation not confirmed");
        require(!disputes[_reservationId].raised, "Dispute already raised");
        address renter = reservations[_reservationId].renter;
        disputes[_reservationId] = Dispute(renter, _reason, true, DisputeOutcome.None);
        emit DisputeRaised(_reservationId, renter, _reason);
    }

    function resolveDispute(uint256 _reservationId, bool _refund) external onlyOwner {
        require(disputes[_reservationId].raised, "No active dispute");

        // Capture before state changes
        address renter = disputes[_reservationId].renter;
        uint256 amount = reservationPayments[_reservationId];

        // Effects: update all state before any external call
        disputes[_reservationId].raised = false;
        disputes[_reservationId].outcome = _refund ? DisputeOutcome.Refunded : DisputeOutcome.Rejected;
        if (_refund) {
            require(amount > 0, "No payment on record to refund");
            reservationPayments[_reservationId] = 0;
        }
        emit DisputeResolved(_reservationId, msg.sender, _refund);

        // Interactions: transfer ETH last to prevent reentrancy
        if (_refund) {
            (bool ok, ) = payable(renter).call{value: amount}("");
            require(ok, "Refund transfer failed");
            emit RefundIssued(_reservationId, renter, amount, "Dispute resolved in renter's favour");
        }
    }

    function getDispute(uint256 _reservationId)
        external
        view
        returns (address renter, string memory reason, bool raised, DisputeOutcome outcome)
    {
        Dispute storage d = disputes[_reservationId];
        return (d.renter, d.reason, d.raised, d.outcome);
    }

    function getReservation(uint256 _reservationId)
        external
        view
        returns (address renter, string memory carType, uint256 pickUpDate, uint256 dropOffDate, bool confirmed)
    {
        require(_reservationId < reservationCount, "Invalid reservation ID");
        Reservation storage r = reservations[_reservationId];
        return (r.renter, r.carType, r.pickUpDate, r.dropOffDate, r.confirmed);
    }

    function getRenterReservations(address _renter) external view returns (uint256[] memory) {
        uint256[] memory temp = new uint256[](reservationCount);
        uint256 count = 0;
        for (uint256 i = 0; i < reservationCount; i++) {
            if (reservations[i].renter == _renter) {
                temp[count] = i;
                count++;
            }
        }
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = temp[i];
        }
        return result;
    }

    function getTotalRentalDays() external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < reservationCount; i++) {
            if (reservations[i].renter != address(0)) {
                total += (reservations[i].dropOffDate - reservations[i].pickUpDate) / 1 days;
            }
        }
        return total;
    }
}
