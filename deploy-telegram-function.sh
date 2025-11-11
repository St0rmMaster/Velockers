#!/bin/bash

# Deploy Telegram notification function to Supabase
echo "Deploying Telegram notification function..."

# Deploy the function
npx supabase functions deploy send-telegram-notification

echo "Deployment complete!"
echo ""
echo "Don't forget to set environment variables in Supabase Dashboard:"
echo "1. TELEGRAM_BOT_TOKEN - Your Telegram bot token"
echo "2. TELEGRAM_CHAT_ID - Your Telegram chat ID"
echo ""
echo "See TELEGRAM_SETUP.txt for detailed instructions"
