import csv
from collections import defaultdict

GRADE_BANDS = {"A": 90, "B": 80, "C": 70, "D": 60}


def letter_for(score):
    for letter, minimum in GRADE_BANDS.items():
        if score >= minimum:
            return letter
    return "F"


def read_scores(path):
    scores = defaultdict(list)
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            scores[row["student"]].append(float(row["score"]))
    return scores


def write_report(scores, path):
    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["student", "average", "grade"])
        for student, marks in scores.items():
            average = sum(marks) / len(marks)
            writer.writerow([student, round(average, 1), letter_for(average)])


def top_students(scores, count=3):
    averages = {name: sum(m) / len(m) for name, m in scores.items()}
    ranked = sorted(averages, key=averages.get, reverse=True)
    return ranked[:count]


if __name__ == "__main__":
    data = read_scores("scores.csv")
    write_report(data, "report.csv")
    print("Top students:", top_students(data))
