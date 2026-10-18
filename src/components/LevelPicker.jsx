export const LEVEL_OPTIONS = [
  { id: 'exterior', label: 'Outside', long: 'Whole house' },
  { id: 'L1', label: '1st', long: 'First floor' },
  { id: 'L2', label: '2nd', long: 'Second floor' },
  { id: 'B', label: 'Bsmt', long: 'Basement' },
]

export default function LevelPicker({ value, onChange, vertical = false }) {
  return (
    <div className={'level-picker' + (vertical ? ' vertical' : '')} role="radiogroup" aria-label="Level">
      {LEVEL_OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          className={value === o.id ? 'on' : ''}
          onClick={() => onChange(o.id)}
        >
          {vertical ? o.long : o.label}
        </button>
      ))}
    </div>
  )
}
