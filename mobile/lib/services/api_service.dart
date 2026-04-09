import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  // Change this to your server IP when deploying
  static const String baseUrl = 'https://give-way-app.onrender.com';

  static Future<Map<String, dynamic>> register({
    required String id,
    required String pin,
    required String role,
    String? badge,
    String? station,
    String? dept,
    String? access,
    String? fullName,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'id': id,
        'pin': pin,
        'role': role,
        'badge': badge,
        'station': station,
        'dept': dept,
        'access': access,
        'fullName': fullName,
      }),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception(data['error'] ?? 'Registration failed');
    return data;
  }

  static Future<Map<String, dynamic>> login({
    required String id,
    required String pin,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'id': id, 'pin': pin}),
    );
    final data = jsonDecode(res.body);
    if (res.statusCode != 200) throw Exception(data['error'] ?? 'Login failed');
    return data;
  }

  static Future<Map<String, dynamic>> getState(String token) async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/state'),
      headers: {'Authorization': 'Bearer $token'},
    );
    return jsonDecode(res.body);
  }

  static Future<List<dynamic>> getAlerts(String token) async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/alerts'),
      headers: {'Authorization': 'Bearer $token'},
    );
    return jsonDecode(res.body);
  }

  static Future<Map<String, dynamic>> getAnalytics(String token) async {
    final res = await http.get(
      Uri.parse('$baseUrl/api/analytics'),
      headers: {'Authorization': 'Bearer $token'},
    );
    return jsonDecode(res.body);
  }
}
