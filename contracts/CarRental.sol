// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract CarRental {

    address public owner;
    address public authorizedBackend;

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

    event CarBooked(address indexed renter, string carType, uint256 pickUpDate, uint256 dropOffDate);
    event ReservationConfirmed(uint256 indexed reservationId);
    event ReservationCanceled(uint256 indexed reservationId);
    event BackendAuthorized(address indexed backend);

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

    function bookCar(
        address _renter,
        string memory _carType,
        uint256 _pickUpDate,
        uint256 _dropOffDate
    ) external onlyBackend {
        reservations.push(Reservation(_renter, _carType, _pickUpDate, _dropOffDate, false));
        reservationCount++;
        emit CarBooked(_renter, _carType, _pickUpDate, _dropOffDate);
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
