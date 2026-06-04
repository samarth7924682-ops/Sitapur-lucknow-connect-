export default async function handler(req, res) {
  const { mobile, otp } = req.query;
  const APITXT_AUTH_KEY = "7wx0YTb39xZuarBHYZvMt3wWTjKRHsqkSI-hzHgr1ZY";
  const url = `https://apitxt.com/api/sendOTP?authkey=${APITXT_AUTH_KEY}&mobile=91${mobile}&otp=${otp}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json(data);
  } catch (err) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({ error: "Failed to send OTP" });
  }
}
