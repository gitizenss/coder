import {
  DataType,
  GraphApi,
  UpdateDataTypeRequest,
} from "@hashintel/hash-graph-client";

import { DataTypeModel } from "../index";
import { incrementVersionedId } from "../util";

type DataTypeModelConstructorArgs = {
  accountId: string;
  schema: DataType;
};

/**
 * @class {@link DataTypeModel}
 */
export default class {
  accountId: string;

  schema: DataType;

  constructor({ schema, accountId }: DataTypeModelConstructorArgs) {
    this.accountId = accountId;
    this.schema = schema;
  }

  /**
   * Create a data type.
   *
   * @todo revisit data type creation
   *   User defined data types are not specified yet, which means this `create`
   *   operation should not be exposed to users yet.
   *   Depends on the RFC captured by:
   *   https://app.asana.com/0/1200211978612931/1202464168422955/f
   *
   * @param params.accountId the accountId of the account creating the data type
   * @param params.schema a `DataType`
   */
  static async create(
    graphApi: GraphApi,
    params: {
      accountId: string;
      schema: DataType;
    },
  ): Promise<DataTypeModel> {
    const { data: identifier } = await graphApi.createDataType(params);

    return new DataTypeModel({
      schema: params.schema,
      accountId: identifier.createdBy,
    });
  }

  /**
   * Get all data types at their latest version.
   *
   * @param params.accountId the accountId of the account requesting the data types
   */
  static async getAllLatest(
    graphApi: GraphApi,
    _params: { accountId: string },
  ): Promise<DataTypeModel[]> {
    /**
     * @todo: get all latest data types in specified account.
     *   This may mean implictly filtering results by what an account is
     *   authorized to see.
     *   https://app.asana.com/0/1202805690238892/1202890446280569/f
     */
    const { data: persistedDataTypes } = await graphApi.getLatestDataTypes();

    return persistedDataTypes.map(
      (persistedDataType) =>
        new DataTypeModel({
          schema: persistedDataType.inner,
          accountId: persistedDataType.identifier.createdBy,
        }),
    );
  }

  /**
   * Get a data type by its versioned URI.
   *
   * @param params.accountId the accountId of the account requesting the data type
   * @param params.versionedUri the unique versioned URI for a data type.
   */
  static async get(
    graphApi: GraphApi,
    params: {
      versionedUri: string;
    },
  ): Promise<DataTypeModel> {
    const { versionedUri } = params;
    const { data: persistedDataType } = await graphApi.getDataType(
      versionedUri,
    );

    return new DataTypeModel({
      schema: persistedDataType.inner,
      accountId: persistedDataType.identifier.createdBy,
    });
  }

  /**
   * Update a data type.
   *
   * @todo revisit data type update
   *   As with data type `create`, this `update` operation is not currently relevant to users
   *   because user defined data types are not fully specified.
   *   Depends on the RFC captured by:
   *   https://app.asana.com/0/1200211978612931/1202464168422955/f
   *
   * @param params.accountId the accountId of the account making the update
   * @param params.schema a `DataType`
   */
  async update(
    graphApi: GraphApi,
    params: {
      accountId: string;
      schema: DataType;
    },
  ): Promise<DataTypeModel> {
    const newVersionedId = incrementVersionedId(this.schema.$id);

    const { accountId, schema } = params;
    const updateArguments: UpdateDataTypeRequest = {
      accountId,
      schema: { ...schema, $id: newVersionedId },
    };

    const { data: identifier } = await graphApi.updateDataType(updateArguments);

    return new DataTypeModel({
      schema: updateArguments.schema,
      accountId: identifier.createdBy,
    });
  }
}
