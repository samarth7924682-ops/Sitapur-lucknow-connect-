export default {
  async fetch(request) {
    const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type"};
    if (request.method === "OPTIONS") return new Response(null, {headers: cors});
    const b = await request.json();
    const res = await fetch("https://api.cashfree.com/pg/orders", {method:"POST",headers:{"Content-Type":"application/json","x-api-version":"2023-08-01","x-client-id":"12994501ff7180bbe19bd075ece0549921","x-client-secret":"cfsk_ma_prod_f742703303f450c287d56666f95b067e_5f571f6d"},body:JSON.stringify({order_id:b.order_id,order_amount:b.amount,order_currency:"INR",customer_details:{customer_id:b.customer_phone,customer_name:b.customer_name,customer_phone:b.customer_phone},order_meta:{return_url:"https://lkostpcouriers.in/booking.html?order_id={order_id}"}})});
    const data = await res.json();
    return new Response(JSON.stringify(data), {headers:{...cors,"Content-Type":"application/json"}});
  }
};
