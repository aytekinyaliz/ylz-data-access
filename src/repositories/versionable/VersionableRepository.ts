import { Model, Query } from "mongoose";
import { debug } from "@ylz/logger";
import { Nullable } from "@ylz/common/src/libs/customTypes";

import { IBaseCreateInput } from "../base/models";
import { IVersionableCreateInput, IVersionableDeleteInput, IVersionableUpdateInput } from "./models";
import { BaseRepository } from "../base/BaseRepository";
import { IVersionableDocument } from "./IVersionableDocument";
import { generateObjectId, lean } from "../../libs/utilities";

export class VersionableRepository<D extends IVersionableDocument> extends BaseRepository<D> {
  constructor(model: Model<D>) {
    super(model);
  }

  /**
   * Create new application
   * @property {string} body.name - The name of record.
   * @returns {Application}
   */
  public async create(input: IVersionableCreateInput): Promise<D> {
    debug("VersionableRepository.create:", JSON.stringify(input));

    const id = input.id || String(generateObjectId());
    const create = {
      ...input,
      id,
      originalId: id
    };

    return super.create(create);

    // const id = input.id || generateObjectId();
    // const model = new this.model({
    //   ...input,
    //   _id: id,
    //   originalId: id
    // });
    // return await model.save();
  }

  /**
   * Insert Many
   * @returns {Documents[]}
   */
  public async insertMany(docs: IBaseCreateInput[], options?: any | null): Promise<D[]> {
    debug("VersionableRepository.insertMany:");

    const docsToInsert: any = docs.map((item) => {
      const id = item.id || String(generateObjectId());
      return { ...item, _id: id, originalId: id };
    });

    return super.insertMany(docsToInsert, options);
  }

  /**
   * Create new application
   * @property {string} id - Record unique identifier.
   * @returns {Application}
   */
  public async update(input: IVersionableUpdateInput): Promise<D> {
    debug("VersionableRepository.update:", JSON.stringify(input));

    debug("Searching for previous valid object...");
    const previous = await this.getById(input.id);

    debug("Invalidating previous valid object...");
    await this.invalidate(input.id);

    const newInstance = Object.assign({}, previous, input);
    newInstance["_id" as string] = generateObjectId();
    delete previous.deletedAt;
    const model = new this.model(newInstance);

    debug("Creating new object...");

    return await model.save();
  }

  public async delete(input: IVersionableDeleteInput): Promise<D> {
    debug("VersionableRepository.delete:", JSON.stringify(input));

    debug("Searching for previous valid object...");
    const previous = await this.getById(input.id);

    debug("Invalidating previous valid object...");
    await this.invalidate(input.id);

    const newId = generateObjectId();
    const newInstance = Object.assign({}, previous, { _id: newId, isSoftDeleted: true });
    const model = new this.model(newInstance);

    return model.save();
  }

  public count(conditions: any): Query<number> {
    debug("VersionableRepository.count:", JSON.stringify(conditions));

    const updatedQuery = {
      deletedAt: null,
      ...conditions
    };

    return super.count(updatedQuery);
  }

  protected getAll(conditions: any, projection?: any | null, options?: any | null, populate?: any | null): Promise<D[]> {
    debug("VersionableRepository.getAll:", JSON.stringify(conditions), JSON.stringify(projection), JSON.stringify(options), populate);

    const updatedQuery = {
      deletedAt: null,
      ...conditions
    };

    return super.getAll(updatedQuery, projection, options, populate);
  }

  protected getById(originalId: string, populate?: any | null): Promise<Nullable<D>> {
    debug("VersionableRepository.getById:", originalId, populate);

    return super.getOne({ originalId, deletedAt: null }, populate);
  }

  protected getByIds(originalIds: string[]): Promise<D[]> {
    debug("VersionableRepository.getByIds:", originalIds);

    return this.getAll({ originalId: { $in: originalIds } });
  }

  protected invalidate(originalId: string): Promise<D> {
    const now = new Date();
    // @ts-ignore
    return lean(this.model.update({ originalId, deletedAt: null }, { deletedAt: now }));
  }
}
