#include <iostream>
#include <vector>
#include <cstring>
#include "item.h"

using namespace std;

const int LOW_STOCK = 3;

int main() {
    vector<Item> items = {{"apples", 12, 0.5}, {"bread", 2, 2.2}, {"milk", 5, 1.1}};
    double total = 0;
    for (auto& item : items) {
        if (item.count < LOW_STOCK) {
            cout << item.name << " is running low" << endl;
            restock(item, 10);
        }
        total += stockValue(item);
    }
    cout << "Stock is worth " << total << endl;

    char label[8];
    strcpy(label, "inventory report");
    int* history = new int[30];
    history[0] = items.size();
    return 0;
}
