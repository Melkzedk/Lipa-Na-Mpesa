const express = require('express');
const app = express();
const axios = require('axios');
require("dotenv").config();
const cors = require('cors');

app.listen(process.env.PORT, () => {
    console.log(`App is running at localhost:${process.env.PORT}`);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/", (req, res) => {
    res.send("<h1>This is a test</h1>");
});

// Middleware to generate token
const generateToken = async (req, res, next) => {
    const secret = process.env.MPESA_SECRET_KEY;
    const consumer = process.env.CONSUMER_KEY;
    const password = Buffer.from(`${consumer}:${secret}`).toString("base64");

    console.log("Authorization Header:", `Basic ${password}`);

    try {
        // Use the sandbox URL for token generation
        const response = await axios.get("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
            headers: {
                Authorization: `Basic ${password}`
            }
        });
        req.token = response.data.access_token;
        console.log("Token generated:", req.token);
        next();
    } catch (err) {
        console.log("Error generating token:", err.response ? err.response.data : err.message);
        res.status(400).json(err.response ? err.response.data : err.message);
    }
};

// STK Push route
app.post("/stk", generateToken, async (req, res) => {
    // Ensure phone number is in international format and does not have a double '254' prefix
    const phone = req.body.phone.startsWith("254") ? req.body.phone : `254${req.body.phone.substring(1)}`;
    const amount = req.body.amount;

    console.log("Phone:", phone, "Amount:", amount);

    const date = new Date();
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    const seconds = ('0' + date.getSeconds()).slice(-2);

    const shortcode = process.env.MPESA_PAYBILL;
    const passkey = process.env.PASSKEY;
    const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
    const password = Buffer.from(shortcode + passkey + timestamp).toString("base64");

    const stkUrl = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
    const data = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,  // Phone number in international format
        PartyB: shortcode,
        PhoneNumber: phone,  // Phone number in international format
        CallBackURL: "https://mydomain.com/path",  // Change this to your actual callback URL
        AccountReference: "CompanyXLTD",
        TransactionDesc: "Payment"
    };

    const headers = {
        Authorization: 'Bearer ' + req.token,
    };

    try {
        const response = await axios.post(stkUrl, data, { headers });
        res.status(200).json(response.data);
    } catch (err) {
        console.log("Error in STK request:", err.response ? err.response.data : err.message);
        res.status(400).json({ error: err.message });
    }
});
