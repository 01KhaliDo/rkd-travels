from http.server import SimpleHTTPRequestHandler, HTTPServer
import json
import pymysql
from urllib.parse import urlparse
from datetime import datetime

DB_CONFIG = {
    "host": "",
    "user": "admin",
    "password": "",
    "database": "",
    "charset": "",
    "cursorclass": pymysql.cursors.DictCursor
}

# Serverkonfiguration
INTERFACE = "127.0.0.1"
PORT = 8080

def datetime_default(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")

class RequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)

        if self.path.startswith('/api/getTrips'):
            try:
                connection = pymysql.connect(**DB_CONFIG)
                with connection.cursor() as cursor:
                    cursor.execute("SELECT * FROM Trips")
                    trips = cursor.fetchall()
                response = {"status": "success", "trips": trips}
                self.send_response(200)
            except pymysql.MySQLError as e:
                response = {"status": "error", "message": str(e)}
                self.send_response(500)
            finally:
                if 'connection' in locals():
                    connection.close()

            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response, default=datetime_default).encode())

        elif self.path.startswith('/api/getTripDetails'):
            parsed_url = urlparse(self.path)
            query_params = dict(param.split('=') for param in parsed_url.query.split('&'))
            trip_id = query_params.get('trip_id')

            connection = pymysql.connect(**DB_CONFIG)
            with connection.cursor() as cursor:
                sql = "SELECT * FROM Trips WHERE trip_id = %s"
                cursor.execute(sql, (trip_id,))
                trip = cursor.fetchone()

                if trip:
                    response = {"status": "success", "trip": trip}
                else:
                    response = {"status": "error", "message": "Resan hittades inte."}

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response, default=datetime_default).encode())

        elif self.path.startswith('/api/getBookings'):
            user_id = parsed_path.query.split('=')[1]

            connection = pymysql.connect(**DB_CONFIG)
            with connection.cursor() as cursor:
                sql = """
                    SELECT Bookings.booking_id, Trips.destination, Trips.price, 
                           Trips.hotel_name, Trips.hotel_stars, Trips.flight_airline, 
                           Trips.departure_time, Trips.return_time, 
                           Bookings.total_price, Bookings.booking_date, Bookings.travels_num
                    FROM Bookings
                    JOIN Trips ON Bookings.trip_id = Trips.trip_id
                    WHERE Bookings.user_id = %s
                """
                cursor.execute(sql, (user_id,))
                bookings = cursor.fetchall()

            if bookings:
                response = {"status": "success", "bookings": bookings}
            else:
                response = {"status": "error", "message": "Inga bokningar hittades."}

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response, default=datetime_default).encode())

        elif self.path.startswith('/api/getUserProfile'):
            user_id = parsed_path.query.split('=')[1]

            connection = pymysql.connect(**DB_CONFIG)
            with connection.cursor() as cursor:
                sql = """
                    SELECT user_id, first_name, last_name, email, phone, created_at 
                    FROM Users WHERE user_id = %s
                """
                cursor.execute(sql, (user_id,))
                user = cursor.fetchone()

            if user:
                response = {"status": "success", "user": user}
            else:
                response = {"status": "error", "message": "Användarprofil hittades inte."}

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response, default=datetime_default).encode())

        else:
            if self.path == "/":
                self.path = "/index.html"
            return SimpleHTTPRequestHandler.do_GET(self)

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)

        try:
            data = json.loads(post_data.decode('utf-8'))

            if self.path.startswith('/api/register'):
                first_name = data["first_name"]
                last_name = data["last_name"]
                email = data["email"]
                phone = data["phone"] 
                password = data["password"]

                connection = pymysql.connect(**DB_CONFIG)
                with connection.cursor() as cursor:
                    sql = """
                        INSERT INTO Users (first_name, last_name, email, phone, password_hash, created_at)
                        VALUES (%s, %s, %s, %s, %s, NOW())
                    """
                    cursor.execute(sql, (first_name, last_name, email, phone, password))
                    connection.commit()
                response = {"status": "success", "message": "Registrering lyckades!"}

            elif self.path.startswith('/api/login'):
                email = data["email"]
                password = data["password"]

                connection = pymysql.connect(**DB_CONFIG)
                with connection.cursor() as cursor:
                    sql = "SELECT * FROM Users WHERE email = %s AND password_hash = %s"
                    cursor.execute(sql, (email, password))
                    user = cursor.fetchone()

                    if user:
                        response = {"status": "success", "message": "Inloggning lyckades!", "user": user}
                    else:
                        response = {"status": "error", "message": "Fel e-post eller lösenord."}

            elif self.path.startswith('/api/bookTrip'):
                user_id = data.get("user_id")
                trip_id = data["trip_id"]
                travels_num = data.get("travels_num", 1)  

                if not user_id:
                    response = {"status": "error", "message": "Du måste vara inloggad för att boka en resa."}
                    self.send_response(403)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(response).encode())
                    return

                connection = pymysql.connect(**DB_CONFIG)
                with connection.cursor() as cursor:
                    connection.begin()
                    cursor.execute("SELECT available_seats, price FROM Trips WHERE trip_id = %s", (trip_id,))
                    trip = cursor.fetchone()

                    if trip and trip['available_seats'] >= travels_num:
                        total_price = trip['price'] * travels_num

                        cursor.execute("UPDATE Trips SET available_seats = available_seats - %s WHERE trip_id = %s", 
                                       (travels_num, trip_id))

                        sql = """
                            INSERT INTO Bookings (user_id, trip_id, total_price, booking_date, travels_num)
                            VALUES (%s, %s, %s, NOW(), %s)
                        """
                        cursor.execute(sql, (user_id, trip_id, total_price, travels_num))
                        connection.commit()

                        response = {"status": "success", "message": "Bokningen lyckades!"} 
                    else:
                        connection.rollback()
                        response = {"status": "error", "message": "Det finns inte tillräckligt många platser kvar."}

            elif self.path.startswith('/api/cancelBooking'):
                booking_id = data["booking_id"]

                connection = pymysql.connect(**DB_CONFIG)
                with connection.cursor() as cursor:
                    cursor.execute("SELECT trip_id, travels_num FROM Bookings WHERE booking_id = %s", (booking_id,))
                    booking = cursor.fetchone()

                    if booking:
                        cursor.execute("UPDATE Trips SET available_seats = available_seats + %s WHERE trip_id = %s",
                                       (booking['travels_num'], booking['trip_id']))

                        cursor.execute("DELETE FROM Bookings WHERE booking_id = %s", (booking_id,))
                        connection.commit()

                        response = {"status": "success", "message": "Bokningen avbokades!"}
                    else:
                        response = {"status": "error", "message": "Bokningen hittades inte."}

        except Exception as e:
            response = {"status": "error", "message": str(e)}

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response, default=datetime_default).encode())

def run(server_class=HTTPServer, handler_class=RequestHandler):
    server_address = (INTERFACE, PORT)
    httpd = server_class(server_address, handler_class)
    httpd.serve_forever()

if __name__ == "__main__":
    run()
