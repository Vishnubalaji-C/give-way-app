import 'dart:convert';
import 'package:http/http.dart' as http;
import 'ws_service.dart';

class ApiService {
  static String get baseUrl => WsService.baseUrl;

  static Future<Map<String, dynamic>> getState() async {
    final res = await http.get(Uri.parse('$baseUrl/api/state'));
    return jsonDecode(res.body);
  }

  static Future<List<dynamic>> getAlerts() async {
    final res = await http.get(Uri.parse('$baseUrl/api/alerts'));
    return jsonDecode(res.body);
  }

  static Future<Map<String, dynamic>> getAnalytics() async {
    final res = await http.get(Uri.parse('$baseUrl/api/analytics'));
    return jsonDecode(res.body);
  }

  static Future<Map<String, dynamic>> switchRole(String role) async {
    final res = await http.patch(
      Uri.parse('$baseUrl/api/auth/role'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'role': role}),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception(data['error'] ?? 'Role switch failed');
    return data;
  }

  static Future<Map<String, dynamic>> login(String id, String pin) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'id': id, 'pin': pin}),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception(data['error'] ?? 'Login failed');
    return data;
  }

  static Future<Map<String, dynamic>> register(Map<String, dynamic> details) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(details),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception(data['error'] ?? 'Registration failed');
    return data;
  }
}
