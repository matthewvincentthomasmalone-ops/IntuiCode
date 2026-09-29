class InsufficientFunds(Exception):
    pass


class Account:
    """A simple bank account."""

    interest_rate = 0.02

    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance
        self.history = []

    def deposit(self, amount):
        if amount <= 0:
            raise ValueError("Deposit must be positive")
        self.balance += amount
        self.history.append(("deposit", amount))

    def withdraw(self, amount):
        if amount > self.balance:
            raise InsufficientFunds(f"{self.owner} has only {self.balance}")
        self.balance -= amount
        self.history.append(("withdraw", amount))

    def add_interest(self):
        interest = self.balance * self.interest_rate
        self.deposit(round(interest, 2))
        return interest

    def __str__(self):
        return f"{self.owner}: {self.balance:.2f}"


def transfer(source, target, amount):
    try:
        source.withdraw(amount)
    except InsufficientFunds as e:
        print("Transfer failed:", e)
        return False
    target.deposit(amount)
    return True


alice = Account("Alice", 100)
bob = Account("Bob")
transfer(alice, bob, 30)
transfer(bob, alice, 500)
alice.add_interest()
for account in [alice, bob]:
    print(account)
