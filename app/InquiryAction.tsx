"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

type InquiryActionProps = {
  className?: string;
  itemName: string;
  kind: "ticket" | "sponsor";
  label: string;
};

export function InquiryAction({ className, itemName, kind, label }: InquiryActionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [status, setStatus] = useState<"error" | "idle" | "sending" | "success">("idle");
  const dialogTitleId = useId();
  const messageLabelId = useId();
  const inquiryLabel = kind === "ticket" ? "Ticket Inquiry" : "Sponsor Inquiry";

  const modal = isOpen && typeof document !== "undefined" ? createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={closeModal}>
      <section
        aria-labelledby={dialogTitleId}
        aria-modal="true"
        className="inquiry-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="inquiry-modal__header">
          <div>
            <p className="inquiry-modal__eyebrow">{inquiryLabel}</p>
            <h2 id={dialogTitleId}>{itemName}</h2>
          </div>
          <button
            aria-label="Close inquiry form"
            className="inquiry-modal__close"
            type="button"
            onClick={closeModal}
          >
            X
          </button>
        </div>

        <p className="inquiry-modal__intro">
          Send your contact details to Joy Stage Productions and we will follow up with
          next steps.
        </p>

        <form className="inquiry-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input name="name" placeholder="Your name" required type="text" />
          </label>
          <label>
            Email
            <input name="email" placeholder="you@example.com" required type="email" />
          </label>
          <label>
            Phone
            <input name="phone" placeholder="Optional" type="tel" />
          </label>
          {kind === "ticket" ? (
            <label>
              Quantity
              <input
                min="1"
                name="quantity"
                placeholder="How many tickets?"
                required
                type="number"
              />
            </label>
          ) : null}
          {kind === "sponsor" ? (
            <label>
              Business Name
              <input
                name="businessName"
                placeholder="Your business name"
                required
                type="text"
              />
            </label>
          ) : null}
          <label aria-labelledby={messageLabelId}>
            <span id={messageLabelId}>Message</span>
            <textarea
              name="message"
              placeholder={`I am interested in ${itemName}. Please send me more information.`}
              rows={4}
            />
          </label>

          <div className="inquiry-form__actions">
            <button
              className="cta cta--ghost inquiry-form__cancel"
              disabled={status === "sending"}
              type="button"
              onClick={closeModal}
            >
              Cancel
            </button>
            <button
              className="cta cta--hot inquiry-form__send"
              disabled={status === "sending"}
              type="submit"
            >
              {status === "sending" ? "Sending..." : "Send Email"}
            </button>
          </div>
          {feedback ? (
            <p className={`inquiry-form__feedback inquiry-form__feedback--${status}`}>
              {feedback}
            </p>
          ) : null}
        </form>
      </section>
    </div>,
    document.body,
  ) : null;

  function closeModal() {
    setIsOpen(false);
    setStatus("idle");
    setFeedback("");
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    document.body.classList.add("modal-open");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setFeedback("");

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name")?.toString().trim() || "";
    const email = formData.get("email")?.toString().trim() || "";
    const phone = formData.get("phone")?.toString().trim() || "";
    const quantity = formData.get("quantity")?.toString().trim() || "";
    const businessName = formData.get("businessName")?.toString().trim() || "";
    const message = formData.get("message")?.toString().trim() || "";

    try {
      const response = await fetch("/api/inquiries", {
        body: JSON.stringify({
          businessName,
          email,
          itemName,
          kind,
          message,
          name,
          phone,
          quantity,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || "The message could not be sent.");
      }

      event.currentTarget.reset();
      setStatus("success");
      setFeedback(result.message || "Your message has been sent.");
    } catch (error) {
      setStatus("error");
      setFeedback(
        error instanceof Error
          ? error.message
          : "The message could not be sent. Please try again.",
      );
    }
  }

  return (
    <>
      <button className={className} type="button" onClick={() => setIsOpen(true)}>
        {label}
      </button>
      {modal}
    </>
  );
}
