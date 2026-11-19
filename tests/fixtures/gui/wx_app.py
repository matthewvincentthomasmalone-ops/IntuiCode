import wx


class Tasks(wx.Frame):
    def __init__(self):
        super().__init__(None, title="Tasks", size=(376, 339))
        panel = wx.Panel(self)
        sizer = wx.BoxSizer(wx.VERTICAL)
        top = wx.BoxSizer(wx.HORIZONTAL)
        self.entry = wx.TextCtrl(panel)
        self.add = wx.Button(panel, label="Add")
        self.add.Bind(wx.EVT_BUTTON, self.on_add)
        top.Add(self.entry, 1, wx.EXPAND | wx.RIGHT, 6)
        top.Add(self.add, 0)
        sizer.Add(top, 0, wx.EXPAND | wx.ALL, 8)
        self.tasks = wx.ListBox(panel)
        sizer.Add(self.tasks, 1, wx.EXPAND | wx.LEFT | wx.RIGHT | wx.BOTTOM, 8)
        panel.SetSizer(sizer)
        self.status = wx.StaticText(panel, label="0 tasks", pos=(12, 270))

    def on_add(self, event):
        self.tasks.Append(self.entry.GetValue())


app = wx.App()
Tasks().Show()
app.MainLoop()
