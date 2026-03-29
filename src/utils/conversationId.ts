export const CONVERSATION_ID_LENGTH = 17;

const TIMESTAMP_PART_LENGTH = 13;
const RANDOM_PART_LENGTH = CONVERSATION_ID_LENGTH - TIMESTAMP_PART_LENGTH;

const CONVERSATION_ID_REGEX = new RegExp(`^\\d{${CONVERSATION_ID_LENGTH}}$`);

const randomNumberFromCrypto = (): number | null => {
  if (!globalThis.crypto?.getRandomValues) {
    return null;
  }

  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] ?? null;
};

const createRandomDigits = (length: number): string => {
  const max = 10 ** length;
  const cryptoValue = randomNumberFromCrypto();
  const rawValue =
    cryptoValue === null ? Math.floor(Math.random() * max) : cryptoValue % max;

  return `${rawValue}`.padStart(length, '0');
};

export const isConversationId = (value: string): boolean => {
  return CONVERSATION_ID_REGEX.test(value);
};

export const createConversationId = (): string => {
  const timestampPart = `${Date.now()}`.padStart(TIMESTAMP_PART_LENGTH, '0');
  const randomPart = createRandomDigits(RANDOM_PART_LENGTH);
  const id = `${timestampPart}${randomPart}`;

  if (!isConversationId(id)) {
    return createConversationId();
  }

  return id;
};
