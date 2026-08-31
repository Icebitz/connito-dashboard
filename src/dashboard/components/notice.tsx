type NoticeProps = {
  message: string | null;
};

export function Notice({ message }: NoticeProps) {
  if (!message) {
    return null;
  }

  return (
    <div className="notice" role="alert" aria-live="assertive">
      <span className="notice-indicator" aria-hidden="true" />
      <div className="notice-copy">
        <strong>Fetch failed</strong>
        <span>{message}</span>
      </div>
    </div>
  );
}
