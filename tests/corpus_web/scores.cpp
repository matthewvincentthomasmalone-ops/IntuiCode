// Class scores: reads a few scores and reports on them.
#include <iostream>
#include <string>
#include <vector>

using namespace std;

class Student {
public:
    string name;
    int score = 0;

    Student(string name, int score) {
        this->name = name;
        this->score = score;
    }

    bool passed() {
        return score >= 50;
    }

    string grade() {
        if (score >= 80) {
            return "A";
        } else if (score >= 65) {
            return "B";
        } else if (score >= 50) {
            return "C";
        }
        return "F";
    }
};

double average(vector<int> scores) {
    int total = 0;
    for (const auto& s : scores) {
        total += s;
    }
    return (double)total / scores.size();
}

int main() {
    Student ada("Ada", 91);
    Student bob("Bob", 47);
    cout << ada.name << " got " << ada.grade() << endl;
    if (!bob.passed()) {
        cout << bob.name << " needs a resit" << endl;
    }

    vector<int> all = {91, 47, 68, 73};
    double avg = average(all);
    cout << "Average: " << avg << endl;

    int count = 0;
    while (count < 3) {
        count++;
    }
    for (int i = 1; i <= 3; i++) {
        cout << "Round " << i << endl;
    }
    return 0;
}
