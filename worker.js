const FIREBASE_URL = "https://sitapur-express-default-rtdb.asia-southeast1.firebasedatabase.app";

async function sendTelegramNotification(order) {
  try {
    const tgRes = await fetch(`${FIREBASE_URL}/admin_settings/telegram.json`);
    const tg = await tgRes.json();
    if (!tg || !tg.bot_token || !tg.chat_id) return;

    const msg = `🚨 *NAYA ORDER AAYA!*

📦 *Order ID:* \`${order.order_id || 'N/A'}\`
🛣️ *Route:* ${order.route || 'N/A'}
⏰ *Time Slot:* ${order.time_slot || 'N/A'}

👤 *Sender:*
   • Name: ${order.sender_name || 'N/A'}
   • Phone: ${order.sender_phone || 'N/A'}
   • Pickup: ${order.pickup_address || 'N/A'}

📬 *Receiver:*
   • Name: ${order.receiver_name || 'N/A'}
   • Phone: ${order.receiver_phone || 'N/A'}
   • Drop: ${order.drop_point || order.delivery_address || 'N/A'}

💰 *Amount:* ₹${order.total_fare || 'N/A'}
✅ *Payment:* ${order.payment_status || 'N/A'}

🔗 Admin: https://lkostpcouriers.in/admin.html`;

    await fetch(`https://api.telegram.org/bot${tg.bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tg.chat_id, text: msg, parse_mode: 'Markdown' })
    });
  } catch (e) {
    console.error("Telegram error:", e);
  }
}

export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);

    // ─── STATUS CHECK ───
    if (url.pathname === "/status") {
      const orderId = url.searchParams.get("order_id");
      const res = await fetch(`https://api.cashfree.com/pg/orders/${orderId}`, {
        headers: {
          "x-api-version": "2023-08-01",
          "x-client-id": "12994501ff7180bbe19bd075ece0549921",
          "x-client-secret": "cfsk_ma_prod_f742703303f450c287d56666f95b067e_5f571f6d"
        }
      });
      const data = await res.json();
      return new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ─── WEBHOOK ───
    if (url.pathname === "/webhook") {
      try {
        const body = await request.json();
        const orderId = body?.data?.order?.order_id || body?.order_id;
        const paymentStatus = body?.data?.payment?.payment_status || body?.payment_status;

        if (orderId && paymentStatus === "SUCCESS") {
          const pendingRes = await fetch(`${FIREBASE_URL}/pending_orders/${orderId}.json`);
          const pendingOrder = await pendingRes.json();

          if (pendingOrder) {
            const txnId = body?.data?.payment?.cf_payment_id || orderId;
            pendingOrder.transaction_id = String(txnId);
            pendingOrder.payment_status = "SUCCESS";

            await fetch(`${FIREBASE_URL}/parcel_bookings/${orderId}.json`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(pendingOrder)
            });

            await fetch(`${FIREBASE_URL}/pending_orders/${orderId}.json`, { method: "DELETE" });

            await sendTelegramNotification({ ...pendingOrder, order_id: orderId });
          }
        }
        return new Response("ok", { headers: cors });
      } catch (e) {
        return new Response("webhook error: " + e.message, { status: 500, headers: cors });
      }
    }

    // ─── MAIN: Order create ───
    try {
      const b = await request.json();

      const cfRes = await fetch("https://api.cashfree.com/pg/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-version": "2023-08-01",
          "x-client-id": "12994501ff7180bbe19bd075ece0549921",
          "x-client-secret": "cfsk_ma_prod_f742703303f450c287d56666f95b067e_5f571f6d"
        },
        body: JSON.stringify({
          order_id: b.order_id,
          order_amount: b.amount,
          order_currency: "INR",
          customer_details: {
            customer_id: b.customer_phone,
            customer_name: b.customer_name,
            customer_phone: b.customer_phone
          },
          order_meta: {
            return_url: "https://lkostpcouriers.in/booking.html?order_id={order_id}"
          }
        })
      });

      const data = await cfRes.json();

      if (data.payment_session_id && b.order_data) {
        await fetch(`${FIREBASE_URL}/pending_orders/${b.order_id}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(b.order_data)
        });
      }

      return new Response(JSON.stringify(data), {
        headers: { ...cors, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }
  }
};
