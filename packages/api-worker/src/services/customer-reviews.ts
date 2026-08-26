import {
  CustomerReviewService,
  type CustomerReviewRepository
} from "@aether-commerce/api-core";

/** D1 adapter for customer-owned review operations. */
export function createCustomerReviewService(db: D1Database): CustomerReviewService {
  const repository: CustomerReviewRepository = {
    async hasPurchasedProduct(userId, productId) {
      const row = await db
        .prepare(
          `select 1 as purchased
             from orders o
             join order_items oi on oi.order_id = o.id
            where o.user_id = ?
              and oi.product_id = ?
              and o.payment_status in ('paid', 'partially_refunded')
              and o.state not in ('cancelled', 'refunded')
            limit 1`
        )
        .bind(userId, productId)
        .first<{ purchased: number }>();
      return Boolean(row?.purchased);
    },
    async create(review) {
      await db
        .prepare(
          "insert into reviews (id, user_id, product_id, rating, title, body, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )
        .bind(review.id, review.userId, review.productId, review.rating, review.title, review.body, review.status)
        .run();
    },
    async update(userId, reviewId, patch) {
      await db
        .prepare("update reviews set title = coalesce(?, title), body = coalesce(?, body), updated_at = CURRENT_TIMESTAMP where id = ? and user_id = ?")
        .bind(patch.title ?? null, patch.body ?? null, reviewId, userId)
        .run();
    },
    async softDelete(userId, reviewId) {
      await db
        .prepare("update reviews set status = 'hidden', updated_at = CURRENT_TIMESTAMP where id = ? and user_id = ?")
        .bind(reviewId, userId)
        .run();
    }
  };
  return new CustomerReviewService(repository, () => crypto.randomUUID());
}
