#include <QApplication>
#include <QWidget>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QLineEdit>
#include <QPushButton>
#include <QListWidget>
#include <QLabel>

class Tasks : public QWidget {
public:
    Tasks() {
        setWindowTitle("Tasks");
        resize(360, 300);
        auto *layout = new QVBoxLayout(this);
        auto *top = new QHBoxLayout();
        entry = new QLineEdit();
        add = new QPushButton(tr("Add"));
        connect(add, &QPushButton::clicked, this, &Tasks::addTask);
        top->addWidget(entry);
        top->addWidget(add);
        layout->addLayout(top);
        tasks = new QListWidget();
        layout->addWidget(tasks);
        status = new QLabel("0 tasks", this);
        status->setGeometry(12, 270, 60, 20);
    }

private:
    void addTask() { tasks->addItem(entry->text()); }
    QLineEdit *entry;
    QPushButton *add;
    QListWidget *tasks;
    QLabel *status;
};

int main(int argc, char *argv[]) {
    QApplication app(argc, argv);
    Tasks w;
    w.show();
    return app.exec();
}
