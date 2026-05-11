export function StepIndicator(props: {
  current: number;
  total: number;
  label: string;
}) {
  const pct = Math.round((props.current / props.total) * 100);
  return (
    <div className="w-full space-y-2">
      <div className="text-muted-foreground flex justify-between text-xs font-medium uppercase tracking-wide">
        <span>{props.label}</span>
        <span>
          {props.current}/{props.total}
        </span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
