"use client";

import { FormEvent, useEffect, useId, useState } from "react";

const recipient = "joy.tence@joystageproductions.com";

type InquiryActionProps = {
  className?: string;
  itemName: string;
  kind: "ticket" | "sponsor";
  label: string;
};

export function InquiryAction({ className, itemName, kind, label }: InquiryActionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogTitleId = useId();
  const messageLabelId = useId();
  const inquiryLabel = kind === "ticket" ? "Ticket Inquiry" : "Sponsor Inquiry";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.body.classList.add("modal-open");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = formData.get("name")?.toString().trim() || "";
    const email = formData.get("email")?.toString().trim() || "";
    const phone = formData.get("phone")?.toString().trim() || "";
    const quantity = formData.get("quantity")?.toString().trim() || "";
    const message = formData.get("message")?.toString().trim() || "";
    const subject = `Beks Battalion ${inquiryLabel} - ${itemName}`;
    const body = [
      `Inquiry Type: ${inquiryLabel}`,
      `Selected Option: ${itemName}`,
      ...(kind === "ticket" ? [`Ticket Quantity: ${quantity || "Not provided"}`] : []),
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone || "Not provided"}`,
      "",
      "Message:",
      message || "Please contact me with more information.",
    ].join("\n");

    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    setIsOpen(false);
  }

  return (
    <>
      <button className={className} type="button" onClick={() => setIsOpen(true)}>
        {label}
      </button>

      {isOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsOpen(false)}>
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
                onClick={() => setIsOpen(false)}
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
                  type="button"
                  onClick={() => setIsOpen(false)}
                >
                  Cancel
                </button>
                <button className="cta cta--hot inquiry-form__send" type="submit">
                  Send Email
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
