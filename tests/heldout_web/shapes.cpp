#include <iostream>
#include <map>
#include <memory>
#include <string>
#include <vector>

struct Point {
    double x;
    double y;
};

class Shape {
public:
    virtual ~Shape() = default;
    virtual double area() const = 0;
};

class Circle : public Shape {
public:
    explicit Circle(double r) : r_(r) {}
    double area() const override { return 3.14159 * r_ * r_; }
private:
    double r_;
};

template <typename T>
T biggest(const std::vector<T>& v) {
    T best = v[0];
    for (const auto& x : v) if (x > best) best = x;
    return best;
}

int count_words(const std::string& text) {
    int words = 0;
    bool inside = false;
    for (char c : text) {
        if (c == ' ') {
            inside = false;
        } else if (!inside) {
            inside = true;
            words++;
        }
    }
    return words;
}

int main() {
    std::map<std::string, int> ages{{"ada", 36}, {"alan", 41}};
    ages["grace"] = 85;
    for (const auto& [name, age] : ages) {
        std::cout << name << ": " << age << "\n";
    }
    auto c = std::make_unique<Circle>(2.0);
    std::cout << "Area " << c->area() << std::endl;
    std::vector<int> nums = {4, 9, 2};
    std::cout << biggest(nums) << std::endl;
    int n = count_words("the quick brown fox");
    switch (n) {
        case 4: std::cout << "four" << std::endl; break;
        default: break;
    }
    int i = 10;
    while (i > 0) {
        i -= 3;
    }
    std::cout << "done " << i << std::endl;
    return 0;
}
