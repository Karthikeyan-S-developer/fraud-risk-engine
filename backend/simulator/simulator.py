import asyncio
import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
from faker import Faker

fake = Faker()

# Major global financial hubs
CITIES = [
    {"name": "New York", "lat": 40.7128, "lon": -74.0060},
    {"name": "London", "lat": 51.5074, "lon": -0.1278},
    {"name": "Chennai", "lat": 13.0827, "lon": 80.2707},
    {"name": "Tokyo", "lat": 35.6762, "lon": 139.6503},
    {"name": "San Francisco", "lat": 37.7749, "lon": -122.4194},
    {"name": "Singapore", "lat": 1.3521, "lon": 103.8198},
    {"name": "Paris", "lat": 48.8566, "lon": 2.3522},
    {"name": "Frankfurt", "lat": 50.1109, "lon": 8.6821},
    {"name": "Sydney", "lat": -33.8688, "lon": 151.2093},
    {"name": "Dubai", "lat": 25.2048, "lon": 55.2708},
]

MERCHANTS = [
    "Amazon Global Store", "Apple Store Regent St", "Uber Technologies",
    "Walmart Supercenter", "Starbucks Coffee", "Steam Digital Gaming",
    "Target Retail", "Delta Air Lines", "Best Buy Electronics", "Nike Flagship",
    "Sephora Beauty", "Nordstrom", "Lululemon", "Sony Interactive", "Airbnb Payments"
]

class TransactionSimulator:
    def __init__(self, ingest_callback=None):
        self.is_running = False
        self.interval = 2.5  # seconds between live stream ticks
        self.ingest_callback = ingest_callback
        self.task = None
        self.stats = {
            "total_generated": 0,
            "normal_generated": 0,
            "fraud_injected": 0,
            "last_injected_scenario": None,
            "started_at": None
        }

        # Preset baseline users
        self.demo_users = [
            {"user_id": "usr_alex_chen", "name": "Alex Chen", "home_city": "Chennai", "home_lat": 13.0827, "home_lon": 80.2707, "avg_amount": 85.0},
            {"user_id": "usr_sarah_miller", "name": "Sarah Miller", "home_city": "New York", "home_lat": 40.7128, "home_lon": -74.0060, "avg_amount": 140.0},
            {"user_id": "usr_vikram_patel", "name": "Vikram Patel", "home_city": "London", "home_lat": 51.5074, "home_lon": -0.1278, "avg_amount": 60.0},
            {"user_id": "usr_elena_rostova", "name": "Elena Rostova", "home_city": "Frankfurt", "home_lat": 50.1109, "home_lon": 8.6821, "avg_amount": 210.0},
            {"user_id": "usr_marcus_vance", "name": "Marcus Vance", "home_city": "San Francisco", "home_lat": 37.7749, "home_lon": -122.4194, "avg_amount": 95.0},
        ]
        
        self.syndicate_device = "dev_rogue_android_x99"
        self.syndicate_address = "742 Evergreen Terrace Suite 4B, Springfield"

    def set_ingest_callback(self, callback):
        self.ingest_callback = callback

    def generate_normal_transaction(self) -> Dict[str, Any]:
        user = random.choice(self.demo_users)
        city = next((c for c in CITIES if c["name"] == user["home_city"]), random.choice(CITIES))
        
        lat = city["lat"] + random.uniform(-0.03, 0.03)
        lon = city["lon"] + random.uniform(-0.03, 0.03)
        
        amount = round(random.uniform(user["avg_amount"] * 0.4, user["avg_amount"] * 1.5), 2)
        txn_id = f"txn_live_{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc)

        return {
            "txn_id": txn_id,
            "user_id": user["user_id"],
            "amount": amount,
            "currency": "USD",
            "merchant": random.choice(MERCHANTS),
            "device_id": f"dev_{user['user_id'][:6]}_{random.randint(10, 99)}",
            "payment_token": f"pmt_{user['user_id'][:6]}_{random.randint(1000, 9999)}",
            "shipping_address": f"{random.randint(100, 999)} High Street, {city['name']}",
            "city": city["name"],
            "latitude": round(lat, 5),
            "longitude": round(lon, 5),
            "timestamp": now,
            "user": user
        }

    def generate_random_stream_fraud(self) -> List[Dict[str, Any]]:
        """
        Generates fresh dynamic fraud vectors during live stream.
        """
        now = datetime.now(timezone.utc)
        fraud_type = random.choice(["teleport", "amount", "velocity", "ring"])
        results = []

        if fraud_type == "teleport":
            # Pick a random user and two distant cities
            user = random.choice(self.demo_users)
            city1, city2 = random.sample(CITIES, 2)
            t1_time = now - timedelta(minutes=random.randint(10, 35))
            
            results.append({
                "txn_id": f"txn_stream_geo1_{uuid.uuid4().hex[:8]}",
                "user_id": user["user_id"],
                "amount": round(random.uniform(40, 150), 2),
                "currency": "USD",
                "merchant": random.choice(MERCHANTS),
                "device_id": f"dev_{user['user_id'][:6]}_mobile",
                "payment_token": f"pmt_{user['user_id'][:6]}_card",
                "shipping_address": f"12 Main St, {city1['name']}",
                "city": city1["name"],
                "latitude": city1["lat"],
                "longitude": city1["lon"],
                "timestamp": t1_time,
                "user": user
            })
            results.append({
                "txn_id": f"txn_stream_geo2_{uuid.uuid4().hex[:8]}",
                "user_id": user["user_id"],
                "amount": round(random.uniform(850, 3500), 2),
                "currency": "USD",
                "merchant": f"Luxury Boutique {city2['name']}",
                "device_id": f"dev_{user['user_id'][:6]}_mobile",
                "payment_token": f"pmt_{user['user_id'][:6]}_card",
                "shipping_address": f"88 Grand Blvd, {city2['name']}",
                "city": city2["name"],
                "latitude": city2["lat"],
                "longitude": city2["lon"],
                "timestamp": now,
                "user": user
            })

        elif fraud_type == "amount":
            user = random.choice(self.demo_users)
            huge_amount = round(user["avg_amount"] * random.uniform(12.0, 45.0), 2)
            results.append({
                "txn_id": f"txn_stream_amt_{uuid.uuid4().hex[:8]}",
                "user_id": user["user_id"],
                "amount": huge_amount,
                "currency": "USD",
                "merchant": "High-Value Diamond Vault",
                "device_id": f"dev_{user['user_id'][:6]}_pc",
                "payment_token": f"pmt_{user['user_id'][:6]}_corp",
                "shipping_address": f"500 Commerce Way, {user['home_city']}",
                "city": user["home_city"],
                "latitude": user["home_lat"],
                "longitude": user["home_lon"],
                "timestamp": now,
                "user": user
            })

        elif fraud_type == "velocity":
            user = random.choice(self.demo_users)
            for i in range(random.randint(5, 7)):
                results.append({
                    "txn_id": f"txn_stream_vel_{i+1}_{uuid.uuid4().hex[:8]}",
                    "user_id": user["user_id"],
                    "amount": round(user["avg_amount"] * random.uniform(0.7, 1.3), 2),
                    "currency": "USD",
                    "merchant": f"Fast-Checkout Store #{i+1}",
                    "device_id": f"dev_{user['user_id'][:6]}_fast",
                    "payment_token": f"pmt_{user['user_id'][:6]}_token",
                    "shipping_address": f"45 Express Lane, {user['home_city']}",
                    "city": user["home_city"],
                    "latitude": user["home_lat"] + random.uniform(-0.01, 0.01),
                    "longitude": user["home_lon"] + random.uniform(-0.01, 0.01),
                    "timestamp": now - timedelta(seconds=(7 - i) * 20),
                    "user": user
                })

        elif fraud_type == "ring":
            selected = random.sample(self.demo_users, 3)
            shared_device = f"dev_syndicate_{random.randint(100, 999)}"
            for i, user in enumerate(selected):
                results.append({
                    "txn_id": f"txn_stream_ring_{i+1}_{uuid.uuid4().hex[:8]}",
                    "user_id": user["user_id"],
                    "amount": round(random.uniform(400, 1200), 2),
                    "currency": "USD",
                    "merchant": "Syndicate Electronics Outlet",
                    "device_id": shared_device,
                    "payment_token": f"pmt_mule_{uuid.uuid4().hex[:6]}",
                    "shipping_address": self.syndicate_address,
                    "city": "Springfield",
                    "latitude": 39.7817,
                    "longitude": -89.6501,
                    "timestamp": now - timedelta(minutes=(3 - i) * 2),
                    "user": user
                })

        return results

    def generate_scenario(self, scenario_type: str) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        results = []

        if scenario_type == "teleport":
            user = self.demo_users[0]
            t1_time = now - timedelta(minutes=31)
            t1 = {
                "txn_id": f"txn_geo_1_{uuid.uuid4().hex[:8]}",
                "user_id": user["user_id"],
                "amount": 42.50,
                "currency": "USD",
                "merchant": "Chennai Express Mart",
                "device_id": "dev_alex_iphone15",
                "payment_token": "pmt_alex_visa_8821",
                "shipping_address": "12 Anna Salai, Chennai",
                "city": "Chennai",
                "latitude": 13.0827,
                "longitude": 80.2707,
                "timestamp": t1_time,
                "user": user
            }
            t2 = {
                "txn_id": f"txn_geo_2_{uuid.uuid4().hex[:8]}",
                "user_id": user["user_id"],
                "amount": 890.00,
                "currency": "USD",
                "merchant": "Harrods Luxury London",
                "device_id": "dev_alex_iphone15",
                "payment_token": "pmt_alex_visa_8821",
                "shipping_address": "87 Brompton Rd, London",
                "city": "London",
                "latitude": 51.5074,
                "longitude": -0.1278,
                "timestamp": now,
                "user": user
            }
            results.extend([t1, t2])

        elif scenario_type == "velocity":
            user = self.demo_users[2]
            for i in range(6):
                t_time = now - timedelta(seconds=(6 - i) * 25)
                results.append({
                    "txn_id": f"txn_vel_{i+1}_{uuid.uuid4().hex[:8]}",
                    "user_id": user["user_id"],
                    "amount": round(user["avg_amount"] * random.uniform(0.8, 1.2), 2),
                    "currency": "USD",
                    "merchant": f"Rapid Store #{i+1}",
                    "device_id": "dev_vikram_pixel8",
                    "payment_token": "pmt_vikram_mc_4412",
                    "shipping_address": "45 Baker Street, London",
                    "city": "London",
                    "latitude": 51.5074 + random.uniform(-0.01, 0.01),
                    "longitude": -0.1278 + random.uniform(-0.01, 0.01),
                    "timestamp": t_time,
                    "user": user
                })

        elif scenario_type == "amount":
            user = self.demo_users[1]
            results.append({
                "txn_id": f"txn_amt_{uuid.uuid4().hex[:8]}",
                "user_id": user["user_id"],
                "amount": 15850.00,
                "currency": "USD",
                "merchant": "High-End Diamond & Watch Co",
                "device_id": "dev_sarah_macbook",
                "payment_token": "pmt_sarah_amex_9901",
                "shipping_address": "500 5th Ave, New York",
                "city": "New York",
                "latitude": 40.7128,
                "longitude": -74.0060,
                "timestamp": now,
                "user": user
            })

        elif scenario_type == "ring":
            for i, user in enumerate(self.demo_users[:3]):
                results.append({
                    "txn_id": f"txn_ring_{i+1}_{uuid.uuid4().hex[:8]}",
                    "user_id": user["user_id"],
                    "amount": 450.00 + (i * 120),
                    "currency": "USD",
                    "merchant": "Global Electronics Liquidation",
                    "device_id": self.syndicate_device,
                    "payment_token": f"pmt_mule_{i+1}_{random.randint(1000, 9999)}",
                    "shipping_address": self.syndicate_address,
                    "city": "Springfield",
                    "latitude": 39.7817,
                    "longitude": -89.6501,
                    "timestamp": now - timedelta(minutes=(3 - i) * 4),
                    "user": user
                })

        elif scenario_type == "combo":
            user = self.demo_users[3]
            results.append({
                "txn_id": f"txn_combo_1_{uuid.uuid4().hex[:8]}",
                "user_id": user["user_id"],
                "amount": 180.00,
                "currency": "USD",
                "merchant": "Frankfurt Central Cafe",
                "device_id": self.syndicate_device,
                "payment_token": "pmt_elena_de_7712",
                "shipping_address": "Zeil 106, Frankfurt",
                "city": "Frankfurt",
                "latitude": 50.1109,
                "longitude": 8.6821,
                "timestamp": now - timedelta(minutes=20),
                "user": user
            })
            results.append({
                "txn_id": f"txn_combo_2_{uuid.uuid4().hex[:8]}",
                "user_id": user["user_id"],
                "amount": 18400.00,
                "currency": "USD",
                "merchant": "Ginza Gold Exchange",
                "device_id": self.syndicate_device,
                "payment_token": "pmt_elena_de_7712",
                "shipping_address": self.syndicate_address,
                "city": "Tokyo",
                "latitude": 35.6762,
                "longitude": 139.6503,
                "timestamp": now,
                "user": user
            })

        self.stats["fraud_injected"] += len(results)
        self.stats["last_injected_scenario"] = scenario_type
        return results

    async def _run_loop(self):
        while self.is_running:
            try:
                # 30% chance to stream fresh real-time fraud attack, 70% normal traffic
                if random.random() < 0.30:
                    fraud_txns = self.generate_random_stream_fraud()
                    for t in fraud_txns:
                        self.stats["total_generated"] += 1
                        self.stats["fraud_injected"] += 1
                        if self.ingest_callback:
                            await self.ingest_callback(t)
                else:
                    txn = self.generate_normal_transaction()
                    self.stats["total_generated"] += 1
                    self.stats["normal_generated"] += 1
                    if self.ingest_callback:
                        await self.ingest_callback(txn)

            except Exception as e:
                print(f"[Simulator] Error in simulation loop: {e}")

            await asyncio.sleep(self.interval)

    def start(self, interval: float = 2.5):
        if not self.is_running:
            self.is_running = True
            self.interval = interval
            self.stats["started_at"] = datetime.now(timezone.utc).isoformat()
            self.task = asyncio.create_task(self._run_loop())
            print(f"[Simulator] Started dynamic live traffic stream (interval={interval}s)")

    def stop(self):
        if self.is_running:
            self.is_running = False
            if self.task:
                self.task.cancel()
                self.task = None
            print("[Simulator] Stopped background traffic stream")

# Global simulator instance
simulator = TransactionSimulator()
