#include <iostream>
#include <vector>
#include <stdexcept>

// A small matrix of doubles, stored row by row.
class Matrix {
public:
    Matrix(int rows, int cols) : rows_(rows), cols_(cols), data_(rows * cols, 0.0) {}

    double& at(int r, int c) {
        if (r < 0 || r >= rows_ || c < 0 || c >= cols_) throw std::out_of_range("bad index");
        return data_[r * cols_ + c];
    }

    int rows() const { return rows_; }
    int cols() const { return cols_; }

private:
    int rows_;
    int cols_;
    std::vector<double> data_;
};

Matrix multiply(Matrix& a, Matrix& b) {
    if (a.cols() != b.rows()) throw std::invalid_argument("sizes do not match");
    Matrix out(a.rows(), b.cols());
    for (int i = 0; i < a.rows(); i++) {
        for (int j = 0; j < b.cols(); j++) {
            double sum = 0;
            for (int k = 0; k < a.cols(); k++) sum += a.at(i, k) * b.at(k, j);
            out.at(i, j) = sum;
        }
    }
    return out;
}

void print(Matrix& m) {
    for (int i = 0; i < m.rows(); i++) {
        for (int j = 0; j < m.cols(); j++) std::cout << m.at(i, j) << " ";
        std::cout << std::endl;
    }
}

int main() {
    Matrix a(2, 2), b(2, 2);
    a.at(0, 0) = 1; a.at(0, 1) = 2; a.at(1, 0) = 3; a.at(1, 1) = 4;
    b.at(0, 0) = 5; b.at(1, 1) = 5;
    Matrix c = multiply(a, b);
    print(c);
    return 0;
}
