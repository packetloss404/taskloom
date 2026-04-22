import type { ReadActivationStatusApiInput, ReadActivationStatusApiResult } from "./contracts";
import type { ActivationStatusDto } from "./domain";
import type { ActivationStatusReadModelRepository, GetActivationStatusDeps } from "./contracts";
import { getActivationStatus } from "./contracts";

export interface ReadActivationStatusApiDeps extends GetActivationStatusDeps {
  readModel?: ActivationStatusReadModelRepository;
}

export async function readActivationStatus(
  deps: ReadActivationStatusApiDeps,
  input: ReadActivationStatusApiInput,
): Promise<ReadActivationStatusApiResult> {
  const status = await getActivationStatus(deps, input);
  if (deps.readModel) {
    await deps.readModel.save(status);
  }
  return {
    ok: true,
    status,
  };
}

export function toActivationStatusDto(status: ActivationStatusDto): ActivationStatusDto {
  return status;
}
