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

    event CarBooked(address indexed renter, string carType, uint256 pickUpDate, uint256 dropOffDate);
    event ReservationConfirmed(uint256 indexed reservationId);
    event ReservationCanceled(uint256 indexed reservationId);
    event BackendAuthorized(address indexed backend);
    event PaymentReceived(uint256 indexed reservationId, address indexed renter, uint256 amount);
    event FundsWithdrawn(address indexed owner, uint256 amount);
    event RentalFeeUpdated(uint256 newFee);
    event DisputeRaised(uint256 indexed reservationId, address indexed renter, string reason);
    event DisputeResolved(uint256 indexed reservationId, address indexed resolver, bool refunded);

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
        emit CarBooked(_renter, _carType, _pickUpDate, _dropOffDate);
        emit PaymentReceived(reservationId, _renter, msg.value);
    }

    function confirmReservation(uint256 _reservationId) external onlyBackend {
        require(_reservationId < reservationCount, "Invalid reservation ID");
        reservations[_reservationId].confirmed = true;
        emit ReservationConfirmed(_reservationId);
    }

    function cancelReservation(uint256 _reservationId) external onlyBackend {
        require(_reservationId < reservationCount, "Invalid reservation ID");
        delete reservations[_reservationId];
        emit ReservationCanceled(_reservationId);
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
        disputes[_reservationId].raised = false;
        disputes[_reservationId].outcome = _refund ? DisputeOutcome.Refunded : DisputeOutcome.Rejected;
        emit DisputeResolved(_reservationId, msg.sender, _refund);
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
}
