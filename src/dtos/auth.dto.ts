class userDto {
  email: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
  role?: string;
  id?: string;
  constructor(model: any) {
    this.id = model.id;
    this.email = model.email;
    this.name = model.name;
    this.role = model.role;
    this.createdAt = model.createdAt;
    this.updatedAt = model.updatedAt;
  }
}

export default userDto;
