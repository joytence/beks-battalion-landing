"use client";

import { FormEvent, useState } from "react";
import { hasTrackingConsent } from "../CookieConsent";

export function ContactForm() {
  const [feedback, setFeedback] = useState("");
  const [status, setStatus] = useState<"error" | "idle" | "sending" | "success">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setFeedback("");

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email")?.toString().trim() || "",
          itemName: formData.get("topic")?.toString().trim() || "General support",
          kind: "support",
          message: formData.get("message")?.toString().trim() || "",
          name: formData.get("name")?.toString().trim() || "",
          phone: formData.get("phone")?.toString().trim() || "",
          sourceUrl: window.location.href,
          trackingConsent: hasTrackingConsent(),
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "The message could not be sent.");
      }

      form.reset();
      setStatus("success");
      setFeedback(result.message || "Your message has been sent.");
    } catch (error) {
      setStatus("error");
      setFeedback(error instanceof Error ? error.message : "The message could not be sent.");
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <label>
        Name
        <input name="name" placeholder="Your name" required type="text" />
      </label>
      <label>
        Email
        <input name="email" placeholder="you@example.com" required type="email" />
      </label>
      <label>
        Phone <span>(optional)</span>
        <input name="phone" placeholder="Best number to reach you" type="tel" />
      </label>
      <label>
        What can we help with?
        <select name="topic" defaultValue="Ticket or order support">
          <option>Ticket or order support</option>
          <option>Payment question</option>
          <option>Accessibility question</option>
          <option>General question</option>
        </select>
      </label>
      <label>
        Message
        <textarea name="message" placeholder="Tell us how we can help." required rows={6} />
      </label>
      <button className="cta cta--hot contact-form__submit" disabled={status === "sending"} type="submit">
        {status === "sending" ? "Sending..." : "Send To Customer Support"}
      </button>
      {feedback ? <p className={`contact-form__feedback contact-form__feedback--${status}`}>{feedback}</p> : null}
    </form>
  );
}
