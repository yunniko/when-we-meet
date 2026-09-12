# D005 · Light-only warm theme; dark mode removed; Owner-supplied hero illustration
Date: 2026-08-17 · Goal: G-001 · Status: active
Context: Owner asked for a light, hand-drawn look.
Decision: Dark-mode media query and every dark: variant removed; design tokens in `app/globals.css` via @theme inline (cream ground, crayon-orange accent); CAN/CANNOT/PREFER colours kept. Hero is an Owner-supplied AI-generated JPEG via next/image; the h1 is sr-only since the image carries the title.
Rejected: maintaining a second unrequested palette.
Consequence: Dark mode is a separate explicit ask.
Evidence: `app/globals.css`; `assets/hero-when-we-meet.jpg`.
