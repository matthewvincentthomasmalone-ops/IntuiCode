import 'package:flutter/material.dart';

const int maxTaps = 20;

void main() {
  runApp(const CounterApp());
}

class CounterApp extends StatelessWidget {
  const CounterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Tap counter',
      theme: ThemeData(colorSchemeSeed: Colors.teal),
      home: const CounterPage(title: 'Taps today'),
    );
  }
}

class CounterPage extends StatefulWidget {
  const CounterPage({super.key, required this.title});

  final String title;

  @override
  State<CounterPage> createState() => _CounterPageState();
}

class _CounterPageState extends State<CounterPage> {
  int _count = 0;

  void _increment() {
    if (_count >= maxTaps) return;
    setState(() {
      _count++;
    });
  }

  Future<void> _reset() async {
    await Future.delayed(const Duration(milliseconds: 300));
    setState(() => _count = 0);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: Center(
        child: Text('$_count of $maxTaps', style: Theme.of(context).textTheme.headlineMedium),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _increment,
        child: const Icon(Icons.add),
      ),
      persistentFooterButtons: [TextButton(onPressed: _reset, child: const Text('Reset'))],
    );
  }
}
