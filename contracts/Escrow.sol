// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Escrow {
    address public owner;
    mapping(address => uint256) public deposits;

    event Deposited(address indexed user, uint256 amount, bytes32 reference);
    event Withdrawn(address indexed to, uint256 amount);

    constructor() {
        owner = msg.sender;
    }

    function deposit(bytes32 reference) external payable {
        require(msg.value > 0, "No value");
        deposits[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, reference);
    }

    // owner withdraws to a destination (for custodial flow) - owner-only
    function withdrawTo(address payable to, uint256 amount) external {
        require(msg.sender == owner, "only owner");
        require(address(this).balance >= amount, "insufficient");
        to.transfer(amount);
        emit Withdrawn(to, amount);
    }

    function balanceOf(address user) external view returns (uint256) {
        return deposits[user];
    }
}
