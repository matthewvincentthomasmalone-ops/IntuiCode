#pragma once
#include <vector>

namespace geo {

class Polygon {
public:
    explicit Polygon(std::vector<double> xs) : xs_(std::move(xs)) {}
    double perimeter() const;
private:
    std::vector<double> xs_;
};

}  // namespace geo
