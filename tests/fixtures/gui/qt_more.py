import sys
from PySide6.QtWidgets import (QApplication, QWidget, QGridLayout, QFormLayout, QVBoxLayout, QLabel, QLineEdit,
                               QPushButton, QCheckBox, QComboBox, QSpinBox, QSlider, QProgressBar, QTextEdit, QGroupBox)
from PySide6.QtCore import Qt


class Form(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Form")
        outer = QVBoxLayout(self)
        box = QGroupBox("Details")
        form = QFormLayout()
        self.name = QLineEdit()
        self.age = QSpinBox()
        self.kind = QComboBox()
        form.addRow("Name", self.name)
        form.addRow("Age", self.age)
        form.addRow("Kind", self.kind)
        box.setLayout(form)
        outer.addWidget(box)
        grid = QGridLayout()
        self.ok = QPushButton("OK")
        self.cancel = QPushButton("Cancel")
        self.agree = QCheckBox("I agree")
        self.level = QSlider(Qt.Horizontal)
        self.bar = QProgressBar()
        grid.addWidget(self.agree, 0, 0)
        grid.addWidget(self.level, 0, 1)
        grid.addWidget(self.ok, 1, 0)
        grid.addWidget(self.cancel, 1, 1)
        outer.addLayout(grid)
        outer.addWidget(self.bar)
        self.notes = QTextEdit()
        outer.addWidget(self.notes)


app = QApplication(sys.argv)
win = Form()
win.show()
sys.exit(app.exec())
