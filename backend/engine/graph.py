import networkx as nx
from typing import Dict, List, Any, Optional, Set

class TransactionGraphEngine:
    def __init__(self):
        # Using MultiGraph to allow multiple edges/relationships if needed
        self.graph = nx.Graph()
        self.flagged_txns: Set[str] = set()

    def add_transaction(self, txn: dict, is_flagged: bool = False):
        """
        Adds a transaction and connects its heterogeneous entities:
        - User node
        - Transaction node
        - Device node (if present)
        - Payment token node (if present)
        - Shipping address node (if present)
        """
        txn_id = txn["txn_id"]
        user_id = txn["user_id"]
        device_id = txn.get("device_id")
        pmt = txn.get("payment_token")
        addr = txn.get("shipping_address")

        txn_node = f"txn:{txn_id}"
        user_node = f"user:{user_id}"

        # 1. Transaction Node
        self.graph.add_node(
            txn_node,
            node_type="txn",
            label=f"TXN {txn_id[:8]}",
            id=txn_id,
            amount=txn.get("amount", 0.0),
            city=txn.get("city", ""),
            is_flagged=is_flagged,
            timestamp=str(txn.get("timestamp", ""))
        )

        # 2. User Node
        if not self.graph.has_node(user_node):
            self.graph.add_node(
                user_node,
                node_type="user",
                label=f"User {user_id[:8]}",
                id=user_id,
                is_flagged=False
            )

        # Connect User to Transaction
        self.graph.add_edge(user_node, txn_node, relationship="PERFORMED")

        # 3. Device Node
        if device_id:
            dev_node = f"device:{device_id}"
            if not self.graph.has_node(dev_node):
                self.graph.add_node(
                    dev_node,
                    node_type="device",
                    label=f"Device {device_id[:8]}",
                    id=device_id
                )
            self.graph.add_edge(txn_node, dev_node, relationship="USED_DEVICE")
            self.graph.add_edge(user_node, dev_node, relationship="ASSOCIATED_WITH")

        # 4. Payment Token Node
        if pmt:
            pmt_node = f"pmt:{pmt}"
            if not self.graph.has_node(pmt_node):
                self.graph.add_node(
                    pmt_node,
                    node_type="pmt",
                    label=f"Card {pmt[:8]}",
                    id=pmt
                )
            self.graph.add_edge(txn_node, pmt_node, relationship="USED_CARD")
            self.graph.add_edge(user_node, pmt_node, relationship="ASSOCIATED_WITH")

        # 5. Shipping Address Node
        if addr:
            addr_node = f"addr:{addr}"
            if not self.graph.has_node(addr_node):
                self.graph.add_node(
                    addr_node,
                    node_type="addr",
                    label=f"Addr {addr[:12]}...",
                    id=addr
                )
            self.graph.add_edge(txn_node, addr_node, relationship="SHIPPED_TO")
            self.graph.add_edge(user_node, addr_node, relationship="ASSOCIATED_WITH")

        if is_flagged:
            self.flagged_txns.add(txn_id)

    def mark_flagged(self, txn_id: str):
        self.flagged_txns.add(txn_id)
        txn_node = f"txn:{txn_id}"
        if self.graph.has_node(txn_node):
            self.graph.nodes[txn_node]["is_flagged"] = True

    def check_shared_entities(
        self, 
        user_id: str, 
        device_id: Optional[str], 
        shipping_address: Optional[str]
    ) -> Dict[str, Any]:
        """
        Detects if device_id or shipping_address is shared across >= 3 distinct user accounts,
        or connected to previously flagged fraudulent transactions.
        """
        shared_devices: Dict[str, List[str]] = {}
        shared_addrs: Dict[str, List[str]] = {}
        connected_to_fraud = False
        fraud_reasons = []

        # Check Device
        if device_id:
            dev_node = f"device:{device_id}"
            if self.graph.has_node(dev_node):
                # Find all user nodes connected to this device
                neighbors = list(self.graph.neighbors(dev_node))
                users_with_dev = {
                    self.graph.nodes[n]["id"] for n in neighbors 
                    if self.graph.nodes[n].get("node_type") == "user"
                }
                users_with_dev.add(user_id)
                if len(users_with_dev) >= 3:
                    shared_devices[device_id] = sorted(list(users_with_dev))
                
                # Check if device touches any flagged txn
                for n in neighbors:
                    if self.graph.nodes[n].get("node_type") == "txn" and self.graph.nodes[n].get("is_flagged"):
                        connected_to_fraud = True
                        fraud_reasons.append(f"Device {device_id[:8]} used in flagged fraud transaction {self.graph.nodes[n]['id']}")

        # Check Shipping Address
        if shipping_address:
            addr_node = f"addr:{shipping_address}"
            if self.graph.has_node(addr_node):
                neighbors = list(self.graph.neighbors(addr_node))
                users_with_addr = {
                    self.graph.nodes[n]["id"] for n in neighbors 
                    if self.graph.nodes[n].get("node_type") == "user"
                }
                users_with_addr.add(user_id)
                if len(users_with_addr) >= 3:
                    shared_addrs[shipping_address] = sorted(list(users_with_addr))

                for n in neighbors:
                    if self.graph.nodes[n].get("node_type") == "txn" and self.graph.nodes[n].get("is_flagged"):
                        connected_to_fraud = True
                        fraud_reasons.append(f"Address {shipping_address[:12]} used in flagged fraud transaction {self.graph.nodes[n]['id']}")

        is_risk = len(shared_devices) > 0 or len(shared_addrs) > 0 or connected_to_fraud

        return {
            "has_risk": is_risk,
            "shared_devices": shared_devices,
            "shared_addresses": shared_addrs,
            "connected_to_fraud": connected_to_fraud,
            "fraud_reasons": fraud_reasons
        }

    def get_subgraph_neighborhood(self, txn_id: str, max_depth: int = 2) -> Dict[str, Any]:
        """
        Extracts egocentric k-hop subgraph around a transaction node for visualization in React.
        """
        txn_node = f"txn:{txn_id}"
        if not self.graph.has_node(txn_node):
            return {"nodes": [], "links": []}

        # BFS expansion up to max_depth
        nodes_at_depth = {0: {txn_node}}
        visited = {txn_node}

        for d in range(1, max_depth + 1):
            next_level = set()
            for current_node in nodes_at_depth[d - 1]:
                for neighbor in self.graph.neighbors(current_node):
                    if neighbor not in visited:
                        visited.add(neighbor)
                        next_level.add(neighbor)
            nodes_at_depth[d] = next_level

        sub = self.graph.subgraph(visited)

        node_list = []
        for n, data in sub.nodes(data=True):
            n_type = data.get("node_type", "entity")
            is_fl = data.get("is_flagged", False)
            risk = "high_risk" if is_fl else "normal"
            if n == txn_node and is_fl:
                risk = "flagged"

            node_list.append({
                "id": n,
                "label": data.get("label", n),
                "type": n_type,
                "risk": risk,
                "properties": {k: v for k, v in data.items() if k not in ["node_type", "label"]}
            })

        link_list = []
        for u, v, data in sub.edges(data=True):
            link_list.append({
                "source": u,
                "target": v,
                "relationship": data.get("relationship", "CONNECTED")
            })

        return {
            "nodes": node_list,
            "links": link_list
        }

# Global singleton instance for in-memory graph
graph_engine = TransactionGraphEngine()
