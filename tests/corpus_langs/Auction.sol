// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IERC721.sol";

/// @title A timed auction for one item; the highest bid wins.
contract Auction {
    address payable public seller;
    uint256 public endsAt;
    address public highestBidder;
    uint256 public highestBid;
    bool public ended;

    mapping(address => uint256) public refunds;

    event BidPlaced(address indexed bidder, uint256 amount);
    event AuctionEnded(address winner, uint256 amount);

    error TooLate();
    error BidTooLow(uint256 needed);

    modifier onlySeller() {
        require(msg.sender == seller, "only the seller can do this");
        _;
    }

    constructor(uint256 durationSeconds) {
        seller = payable(msg.sender);
        endsAt = block.timestamp + durationSeconds;
    }

    function bid() external payable {
        if (block.timestamp > endsAt) revert TooLate();
        if (msg.value <= highestBid) revert BidTooLow(highestBid + 1);
        if (highestBidder != address(0)) {
            refunds[highestBidder] += highestBid;
        }
        highestBidder = msg.sender;
        highestBid = msg.value;
        emit BidPlaced(msg.sender, msg.value);
    }

    function withdraw() external returns (bool) {
        uint256 amount = refunds[msg.sender];
        if (amount == 0) return false;
        refunds[msg.sender] = 0;
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "refund failed");
        return true;
    }

    function end() external onlySeller {
        require(block.timestamp >= endsAt, "not finished yet");
        require(!ended, "already ended");
        ended = true;
        emit AuctionEnded(highestBidder, highestBid);
        seller.transfer(highestBid);
    }

    function timeLeft() public view returns (uint256) {
        return block.timestamp >= endsAt ? 0 : endsAt - block.timestamp;
    }
}
