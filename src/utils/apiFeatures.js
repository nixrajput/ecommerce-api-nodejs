const mongoose = require("mongoose");

const RANGE_FIELDS = ["price", "ratings"];
const RANGE_OPERATORS = ["gt", "gte", "lt", "lte"];

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

class ApiFeatures {
  constructor(query, queryStr) {
    this.query = query;
    this.queryStr = queryStr;
  }

  search() {
    const { keyword } = this.queryStr;
    const filter =
      typeof keyword === "string" && keyword
        ? {
            name: mongoose.trusted({
              $regex: escapeRegex(keyword),
              $options: "i",
            }),
          }
        : {};

    this.query = this.query.find(filter);
    return this;
  }

  // Express 5's default query parser keeps bracket keys flat: "price[gte]", not { price: { gte } }.
  filter() {
    const filter = {};

    if (typeof this.queryStr.category === "string") {
      filter.category = this.queryStr.category;
    }

    for (const field of RANGE_FIELDS) {
      const range = {};

      for (const op of RANGE_OPERATORS) {
        const value = this.queryStr[`${field}[${op}]`];
        if (typeof value === "string") range[`$${op}`] = value;
      }

      if (Object.keys(range).length) filter[field] = mongoose.trusted(range);
    }

    this.query = this.query.find(filter);
    return this;
  }

  pagination(resultPerPage) {
    const currentPage = Math.max(1, Number.parseInt(this.queryStr.page, 10) || 1);

    const skip = resultPerPage * (currentPage - 1);

    this.query = this.query.limit(resultPerPage).skip(skip);
    return this;
  }
}

module.exports = ApiFeatures;
