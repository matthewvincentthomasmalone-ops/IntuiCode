#include <iostream>
#include <vector>
#include <string>

int add(int a, int b) {
    return a + b;
}

double average(const std::vector<int>& values) {
    int total = 0;
    for (int v : values) {
        total += v;
    }
    return static_cast<double>(total) / values.size();
}

std::string grade(int score) {
    if (score >= 90) {
        return "A";
    } else if (score >= 80) {
        return "B";
    }
    return "C";
}

void greet(std::string name) {
    std::cout << "Hello, " << name << "!" << std::endl;
}

int main() {
    std::vector<int> scores;
    std::string name;
    std::cout << "Your name: ";
    std::getline(std::cin, name);
    greet(name);
    int count;
    std::cout << "How many scores? ";
    std::cin >> count;
    for (int i = 0; i < count; i++) {
        int s;
        std::cin >> s;
        scores.push_back(s);
    }
    for (int i = 0; i < 10; i++) {
        std::cout << i << std::endl;
    }
    for (int i = 1; i <= 5; i++) {
        std::cout << i << " ";
    }
    std::cout << std::endl;
    int sum = add(2, 3);
    std::cout << "Sum: " << sum << std::endl;
    std::cout << "Average: " << average(scores) << "\n";
    std::cout << grade(85) << std::endl;
    int n = 10;
    while (n > 0) {
        n -= 3;
    }
    do {
        n++;
    } while (n < 5);
    switch (n) {
        case 1:
            std::cout << "one" << std::endl;
            break;
        case 2:
            std::cout << "two" << std::endl;
            break;
        default:
            std::cout << "many" << std::endl;
    }
    std::vector<std::string> names = {"Ada", "Bo"};
    names.push_back("Cy");
    std::cout << names.size() << std::endl;
    bool done = false;
    if (!done && n > 2) {
        std::cout << "not done" << std::endl;
    }
    return 0;
}
