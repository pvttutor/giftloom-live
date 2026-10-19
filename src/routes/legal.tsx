import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/SiteChrome";

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Terms & privacy — Giftloom" },
      { name: "description", content: "Terms of sale and privacy notes for Giftloom." },
      { property: "og:title", content: "Terms & privacy — Giftloom" },
      { property: "og:description", content: "How orders, payments and your data are handled." },
    ],
  }),
  component: Legal,
});

const SECTIONS: [string, string][] = [
  ["Digital gift cards", "Giftloom sells digital gift card codes for third-party brands. After your payment is verified, the code is shown on the confirmation page and kept in My cards. Codes are redeemed with the brand, under the brand's own terms."],
  ["Payments", "Payments are processed by our payment gateway (currently Razorpay). We never see or store your card, UPI or bank details. An order stays pending until the gateway confirms the payment."],
  ["Refunds", "Because a digital code cannot be returned once it has been shown, completed orders are not refundable. If you paid and your code was not delivered, contact us with your order number and we will arrange a replacement or a refund."],
  ["Your account and codes", "Keep your password and your codes private. Anyone holding a code can use it, and we cannot replace a code that has been shared or used."],
  ["Privacy", "We store your email address, a securely hashed password, your orders, and anything you send us through the support, feedback and contact forms. Gift card codes are stored encrypted. We use this information to run your account, deliver your orders and answer your questions. Contact us to ask about or delete your data."],
];

function Legal() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader title="Terms & privacy" subtitle="Last updated October 2026." />
      <div className="space-y-6 leading-relaxed text-muted-foreground">
        {SECTIONS.map(([title, text]) => (
          <section key={title}><h2 className="mb-2 text-xl font-bold text-foreground">{title}</h2><p>{text}</p></section>
        ))}
      </div>
    </div>
  );
}
