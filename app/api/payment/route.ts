import { NextResponse, NextRequest } from 'next/server'
import Stripe from 'stripe'

export async function GET(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET!, {
    typescript: true,
  })

  const products = await stripe.prices.list({
    limit: 3,
  })

  return NextResponse.json(products.data)
}

export async function POST(req: NextRequest) {
  const baseUrl = (process.env.NEXT_PUBLIC_URL || 'http://localhost:3000').trim()
  const stripe = new Stripe(process.env.STRIPE_SECRET!, {
    typescript: true,
    apiVersion: '2025-05-28.basil',
  })
  const data = await req.json()
  const session = await stripe.checkout.sessions.create({
    line_items: [
      { 
        price: data.priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: `${baseUrl}/billing?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/billing`,
  })
  return NextResponse.json(session.url)
}
