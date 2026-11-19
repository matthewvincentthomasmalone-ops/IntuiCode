import sys
from PySide6.QtWidgets import QApplication, QWidget, QVBoxLayout, QHBoxLayout, QLineEdit, QPushButton, QListWidget, QLabel


class Tasks(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Tasks")
        self.resize(360, 300)
        layout = QVBoxLayout(self)
        top = QHBoxLayout()
        self.entry = QLineEdit()
        self.add = QPushButton("Add")
        self.add.clicked.connect(self.add_task)
        top.addWidget(self.entry)
        top.addWidget(self.add)
        layout.addLayout(top)
        self.tasks = QListWidget()
        layout.addWidget(self.tasks)
        self.status = QLabel("0 tasks", self)
        self.status.move(12, 270)

    def add_task(self):
        self.tasks.addItem(self.entry.text())


app = QApplication(sys.argv)
win = Tasks()
win.show()
sys.exit(app.exec())
