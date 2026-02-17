export function createRenderer({ renderImpl }){
  return { render: renderImpl };
}
