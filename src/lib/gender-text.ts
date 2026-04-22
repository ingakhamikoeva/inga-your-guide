export type UserSex = 'female' | 'male' | undefined | null;

export function getText(femaleText: string, maleText: string, sex: UserSex) {
  return sex === 'male' ? maleText : femaleText;
}