import random

WORDS = ["python", "sentence", "blueprint", "keyboard"]
MAX_MISSES = 6


def masked(word, guessed):
    return " ".join(letter if letter in guessed else "_" for letter in word)


def play():
    word = random.choice(WORDS)
    guessed = set()
    misses = 0
    while misses < MAX_MISSES:
        print(masked(word, guessed))
        letter = input("Letter: ").lower()
        if len(letter) != 1 or not letter.isalpha():
            print("One letter, please.")
            continue
        if letter in guessed:
            print("Already tried that.")
            continue
        guessed.add(letter)
        if letter not in word:
            misses += 1
            print(f"No! {MAX_MISSES - misses} misses left.")
        if all(ch in guessed for ch in word):
            print("You win! The word was", word)
            return True
    print("Out of misses. The word was", word)
    return False


wins = 0
while True:
    if play():
        wins += 1
    again = input("Play again? (y/n) ")
    if again.lower() != "y":
        break
print("Wins:", wins)
