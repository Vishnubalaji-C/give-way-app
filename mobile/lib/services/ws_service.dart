import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

class WsService {
  static const String wsUrl = 'ws://10.0.2.2:4000';
  WebSocketChannel? _channel;
  final _stateController = StreamController<Map<String, dynamic>>.broadcast();
  final _alertController = StreamController<Map<String, dynamic>>.broadcast();
  bool _connected = false;

  Stream<Map<String, dynamic>> get stateStream => _stateController.stream;
  Stream<Map<String, dynamic>> get alertStream => _alertController.stream;
  bool get connected => _connected;

  void connect() {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(wsUrl));
      _connected = true;

      _channel!.stream.listen(
        (data) {
          final msg = jsonDecode(data);
          switch (msg['type']) {
            case 'INIT':
            case 'STATE_UPDATE':
              _stateController.add(msg['payload']);
              break;
            case 'JUNCTION_SWITCH':
              _stateController.add(msg['payload']['state']);
              break;
            case 'ALERT':
              _alertController.add(msg['payload']);
              break;
            case 'RESET':
              _stateController.add(msg['payload']);
              break;
          }
        },
        onError: (e) {
          _connected = false;
          Future.delayed(const Duration(seconds: 3), connect);
        },
        onDone: () {
          _connected = false;
          Future.delayed(const Duration(seconds: 3), connect);
        },
      );
    } catch (e) {
      _connected = false;
      Future.delayed(const Duration(seconds: 3), connect);
    }
  }

  void send(String type, [Map<String, dynamic>? payload]) {
    if (_channel != null) {
      _channel!.sink.add(jsonEncode({
        'type': type,
        if (payload != null) 'payload': payload,
      }));
    }
  }

  void dispose() {
    _channel?.sink.close();
    _stateController.close();
    _alertController.close();
  }
}
