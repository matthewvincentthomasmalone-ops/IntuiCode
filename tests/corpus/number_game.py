import random

secret = random.randint(1, 100)
tries = 0
print("Guess my number between 1 and 100")
while True:
    guess = int(input("Your guess: "))
    tries += 1
    if guess < secret:
        print("Higher")
    elif guess > secret:
        print("Lower")
    else:
        print(f"Correct in {tries} tries!")
        break
scores = []
scores.append(tries)
best = min(scores)
print("Best score:", best)
