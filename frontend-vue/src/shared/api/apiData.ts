import type { AxiosResponse } from 'axios'

export const apiData = async <T>(promise: Promise<AxiosResponse<T>>): Promise<T> =>
  (await promise).data
