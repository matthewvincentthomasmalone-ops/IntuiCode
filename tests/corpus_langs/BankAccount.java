package com.example.bank;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * A current account that keeps a history of every change to its balance.
 */
public class BankAccount implements Comparable<BankAccount> {
    public static final BigDecimal OVERDRAFT_LIMIT = new BigDecimal("250.00");

    private final String owner;
    private BigDecimal balance = BigDecimal.ZERO;
    private final List<String> history = new ArrayList<>();

    public BankAccount(String owner) {
        this.owner = owner;
    }

    public void deposit(BigDecimal amount) {
        if (amount.signum() <= 0) {
            throw new IllegalArgumentException("Deposits must be positive");
        }
        balance = balance.add(amount);
        history.add("deposit " + amount);
    }

    public void withdraw(BigDecimal amount) throws InsufficientFundsException {
        BigDecimal after = balance.subtract(amount);
        if (after.compareTo(OVERDRAFT_LIMIT.negate()) < 0) {
            throw new InsufficientFundsException(owner, amount);
        }
        balance = after;
        history.add("withdraw " + amount);
    }

    public BigDecimal getBalance() {
        return balance;
    }

    public List<String> getHistory() {
        return new ArrayList<>(history);
    }

    @Override
    public int compareTo(BankAccount other) {
        return balance.compareTo(other.balance);
    }

    public static void main(String[] args) {
        BankAccount acc = new BankAccount("Ada");
        acc.deposit(new BigDecimal("100"));
        try {
            acc.withdraw(new BigDecimal("400"));
        } catch (InsufficientFundsException e) {
            System.out.println("Refused: " + e.getMessage());
        }
        System.out.println(acc.getBalance());
    }
}

class InsufficientFundsException extends Exception {
    InsufficientFundsException(String owner, BigDecimal amount) {
        super(owner + " cannot take out " + amount);
    }
}
