export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-destructive text-xs">
      {message}
    </p>
  )
}
