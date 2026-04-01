export const PaperKnifeLogo = ({
  size = 24,
  className = '',
}: {
  size?: number;
  className?: string;
  iconColor?: string;
  partColor?: string;
}) => (
  <img
    src="/logos/icon.png"
    alt=""
    width={size}
    height={size}
    className={className}
    draggable={false}
  />
);
